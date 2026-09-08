import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Admin from "./pages/Admin";
import Ask from "./pages/Ask";
import Wall from "./pages/Wall";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Ask />} />
        <Route path="wall" element={<Wall />} />
        {/* Hidden moderator route: no nav link points here. */}
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Ask />} />
      </Route>
    </Routes>
  );
}
