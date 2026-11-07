import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Emblem } from "./components/ui";
import { AdministratorsPage } from "./pages/Administrators";
import { AuditPage } from "./pages/Audit";
import { FormsPage } from "./pages/Forms";
import { InvestigationsPage } from "./pages/Investigations";
import { InvitePage } from "./pages/Invite";
import { LeaderboardPage } from "./pages/Leaderboard";
import { PricingPage } from "./pages/Pricing";
import { LoginPage } from "./pages/Login";
import { MessagesPage } from "./pages/Messages";
import { MyPointsPage } from "./pages/MyPoints";
import { OverviewPage } from "./pages/Overview";
import { PeoplePage } from "./pages/People";
import { RequestsPage } from "./pages/Requests";
import { SecurityPage } from "./pages/Security";
import { Shell } from "./pages/Shell";

// The map library is only needed while sending a case.
const NewInvestigationPage = lazy(() => import("./pages/NewInvestigation"));
const InvestigatorProfilePage = lazy(() => import("./pages/InvestigatorProfile"));

export function App() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="boot-screen" role="status">
        <Emblem className="boot-emblem" />
        <span>جارٍ تجهيز مساحة العمل…</span>
        <i />
      </div>
    );

  return (
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={user ? <Shell /> : <Navigate to="/login" replace />}
      >
        <Route index element={<OverviewPage />} />
        <Route path="administrators" element={<AdministratorsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="investigations" element={<InvestigationsPage />} />
        <Route
          path="investigations/new"
          element={
            <Suspense fallback={null}>
              <NewInvestigationPage />
            </Suspense>
          }
        />
        <Route path="forms" element={<FormsPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="performance" element={<LeaderboardPage />} />
        <Route
          path="people/:id"
          element={
            <Suspense fallback={null}>
              <InvestigatorProfilePage />
            </Suspense>
          }
        />
        <Route path="audit" element={<AuditPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="my-points" element={<MyPointsPage />} />
        <Route path="messages" element={<MessagesPage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
