"""Simulation engine package.

Public surface:
- SimulationEngine (engine.simulation) — graph in, result out.
- REGISTRY / DEFAULTS (engine.components) — component strategies + config defaults.
"""
from engine.simulation import SimulationEngine

__all__ = ["SimulationEngine"]
