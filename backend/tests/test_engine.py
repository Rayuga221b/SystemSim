"""Engine behaviour: per-component semantics and traversal rules.

These tests document the engine as much as they verify it — each one asserts
a rule stated in the engine/components.py or engine/simulation.py docstrings.
"""
import pytest

from engine.simulation import SimulationEngine


def g(nodes, edges):
    """Terse graph builder: nodes as (id, type, config?) tuples."""
    return {
        "nodes": [{"id": n[0], "type": n[1],
                   "config": (n[2] if len(n) > 2 else {})} for n in nodes],
        "edges": [{"id": f"e{i}", "source": s, "target": t}
                  for i, (s, t) in enumerate(edges)],
    }


def run(graph, load=1000, failures=None, read_pct=80):
    return SimulationEngine(graph).run(load_rps=load, failures=failures,
                                       read_pct=read_pct)


# ---------------------------------------------------------------- components
def test_cache_absorbs_reads_only():
    # 1000 rps @ 80% reads -> 800 reads, 200 writes.
    # Cache at 80% hit rate absorbs 640; 160 read-misses + 200 writes go on.
    graph = g([("c", "client"), ("k", "cache", {"hit_rate": 80}),
               ("db", "sql_db")],
              [("c", "k"), ("k", "db")])
    res = run(graph)
    assert res["node_metrics"]["k"]["out_rps"] == pytest.approx(360, abs=1)
    assert res["node_metrics"]["db"]["in_rps"] == pytest.approx(360, abs=1)


def test_cache_miss_spike_failure_collapses_hit_rate():
    graph = g([("c", "client"), ("k", "cache", {"hit_rate": 90}),
               ("db", "sql_db")],
              [("c", "k"), ("k", "db")])
    healthy = run(graph)["node_metrics"]["db"]["in_rps"]
    spiked = run(graph, failures={"k": "cache_miss_spike"})["node_metrics"]["db"]["in_rps"]
    assert spiked > healthy * 3  # 10% hit rate lets ~9x more reads through


def test_load_balancer_splits_evenly_everything_else_fans_out_full():
    graph = g([("c", "client"), ("lb", "load_balancer"),
               ("a1", "app_server", {"instances": 4}),
               ("a2", "app_server", {"instances": 4})],
              [("c", "lb"), ("lb", "a1"), ("lb", "a2")])
    res = run(graph, load=1000)
    assert res["node_metrics"]["a1"]["in_rps"] == pytest.approx(500, abs=1)
    assert res["node_metrics"]["a2"]["in_rps"] == pytest.approx(500, abs=1)

    # Non-LB fan-out sends the FULL stream to each successor (documented rule).
    graph2 = g([("c", "client"), ("a", "app_server", {"instances": 4}),
                ("k", "cache"), ("q", "message_queue")],
               [("c", "a"), ("a", "k"), ("a", "q")])
    res2 = run(graph2, load=1000)
    assert res2["node_metrics"]["k"]["in_rps"] == pytest.approx(1000, abs=1)
    assert res2["node_metrics"]["q"]["in_rps"] == pytest.approx(1000, abs=1)


def test_sql_write_bottleneck_detected():
    # 5000 rps @ 20% reads -> 4000 writes into a 1000-write primary.
    graph = g([("c", "client"),
               ("a", "app_server", {"instances": 20, "rps_per_instance": 500}),
               ("db", "sql_db", {"primary_capacity": 1000})],
              [("c", "a"), ("a", "db")])
    res = run(graph, load=5000, read_pct=20)
    assert res["node_statuses"]["db"] == "overloaded"
    assert "db" in res["bottlenecks"]
    assert any("primary" in w for w in res["warnings"])


def test_rate_limiter_caps_throughput():
    graph = g([("c", "client"), ("rl", "rate_limiter", {"threshold": 100})],
              [("c", "rl")])
    res = run(graph, load=1000)
    assert res["throughput_achieved_rps"] == pytest.approx(100, abs=1)
    assert res["node_statuses"]["rl"] == "overloaded"


def test_queue_lag_when_producers_outpace_workers():
    graph = g([("c", "client"),
               ("a", "app_server", {"instances": 10, "rps_per_instance": 500}),
               ("q", "message_queue"),
               ("w", "worker", {"instances": 1, "consume_rps": 500}),
               ("db", "nosql_db")],
              [("c", "a"), ("a", "q"), ("q", "w"), ("w", "db")])
    res = run(graph, load=2000)
    assert res["node_statuses"]["q"] == "warning"
    assert any("lag" in w for w in res["warnings"])
    # Workers only ever see what they can drain.
    assert res["node_metrics"]["w"]["in_rps"] == pytest.approx(500, abs=1)
    # Buffered traffic is NOT dropped: achieved stays at requested.
    assert res["throughput_achieved_rps"] == pytest.approx(2000, abs=1)


# ----------------------------------------------------------------- traversal
def test_node_crash_kills_downstream_traffic():
    graph = g([("c", "client"), ("a", "app_server"), ("db", "sql_db")],
              [("c", "a"), ("a", "db")])
    res = run(graph, load=500, failures={"a": "node_crash"})
    assert res["node_statuses"]["a"] == "failed"
    assert res["node_metrics"]["db"]["in_rps"] == 0
    assert res["throughput_achieved_rps"] == 0


def test_traffic_spike_doubles_requested_load():
    graph = g([("c", "client"), ("a", "app_server")], [("c", "a")])
    res = run(graph, load=700, failures={"c": "traffic_spike"})
    assert res["throughput_requested_rps"] == pytest.approx(1400)


def test_slow_node_inflates_critical_path():
    graph = g([("c", "client"), ("s", "object_storage", {"latency_ms": 50})],
              [("c", "s")])
    base = run(graph)["critical_path_latency_ms"]
    slow = run(graph, failures={"s": "slow_node"})["critical_path_latency_ms"]
    assert slow == pytest.approx(base * 10, rel=0.01)


def test_disconnected_node_warns_but_never_crashes():
    graph = g([("c", "client"), ("a", "app_server"), ("orphan", "cache")],
              [("c", "a")])
    res = run(graph)
    assert res["node_statuses"]["orphan"] == "healthy"
    assert any("not connected" in w for w in res["warnings"])


def test_cycle_is_broken_with_warning_not_infinite_loop():
    graph = g([("c", "client"), ("a", "app_server"), ("b", "app_server")],
              [("c", "a"), ("a", "b"), ("b", "a")])
    res = run(graph)
    assert any("cycle" in w.lower() for w in res["warnings"])


def test_no_client_raises_value_error():
    with pytest.raises(ValueError):
        run(g([("a", "app_server")], []))


def test_replication_lag_is_freshness_warning_not_throughput():
    graph = g([("c", "client"), ("db", "sql_db", {"replicas": 2})],
              [("c", "db")])
    res = run(graph, load=100, failures={"db": "replication_lag"})
    assert res["node_statuses"]["db"] == "warning"
    assert any("stale" in w for w in res["warnings"])
    assert res["throughput_achieved_rps"] == pytest.approx(100, abs=1)
