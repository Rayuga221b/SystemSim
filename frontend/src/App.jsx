import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex gap-4 px-6 py-3 border-b text-sm">
        <Link to="/" className="font-semibold">SystemSim</Link>
        <Link to="/sandbox">Sandbox</Link>
        <Link to="/challenges">Challenges</Link>
        <Link to="/case-studies">Case Studies</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
