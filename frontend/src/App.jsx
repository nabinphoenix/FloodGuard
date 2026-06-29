import { Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateAlert from "./pages/admin/CreateAlert";
import Dashboard from "./pages/admin/Dashboard";
import ManageReports from "./pages/admin/ManageReports";
import ManageUsers from "./pages/admin/ManageUsers";
import ManageZones from "./pages/admin/ManageZones";
import AlertFeed from "./pages/public/AlertFeed";
import FloodMap from "./pages/public/FloodMap";
import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Profile from "./pages/public/Profile";
import Register from "./pages/public/Register";
import CommunityFeed from "./pages/reports/CommunityFeed";
import MyReports from "./pages/reports/MyReports";
import ReportDetail from "./pages/reports/ReportDetail";
import SubmitReport from "./pages/reports/SubmitReport";
import SensorDash from "./pages/sensors/SensorDash";
import SystemHealth from "./pages/sensors/SystemHealth";
import Thresholds from "./pages/sensors/Thresholds";
import WaterLevelChart from "./pages/sensors/WaterLevelChart";

function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-2xl rounded-lg border border-blue-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
        <p className="mt-3 text-slate-600">The FloodGuard page you requested does not exist.</p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/alerts" element={<AlertFeed />} />
        <Route path="/map" element={<FloodMap />} />
        <Route path="/reports/community" element={<CommunityFeed />} />
        <Route path="/reports/:reportId" element={<ReportDetail />} />
        <Route
          path="/reports/submit"
          element={
            <ProtectedRoute>
              <SubmitReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/my"
          element={
            <ProtectedRoute>
              <MyReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute role="admin">
              <ManageReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/create-alert"
          element={
            <ProtectedRoute role="admin">
              <CreateAlert />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/zones"
          element={
            <ProtectedRoute role="admin">
              <ManageZones />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="admin">
              <ManageUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sensors"
          element={
            <ProtectedRoute role="authority">
              <SensorDash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sensors/chart"
          element={
            <ProtectedRoute role="authority">
              <WaterLevelChart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sensors/thresholds"
          element={
            <ProtectedRoute role="authority">
              <Thresholds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sensors/health"
          element={
            <ProtectedRoute role="authority">
              <SystemHealth />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        <Route path="/sensors/*" element={<Navigate to="/sensors" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
