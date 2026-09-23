import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AppShell } from "./components/layout/AppShell";
import { PageTransition } from "./components/PageTransition";
import { RolePicker } from "./pages/RolePicker";
import { RequesterHome } from "./pages/requester/RequesterHome";
import { RequestDetail } from "./pages/requester/RequestDetail";
import { RequestHistory } from "./pages/requester/RequestHistory";
import { ContactInbox } from "./pages/contact/ContactInbox";
import { VerificationDetail } from "./pages/contact/VerificationDetail";
import { FamilyDashboard } from "./pages/FamilyDashboard";
import { NotFound } from "./pages/NotFound";

export default function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><RolePicker /></PageTransition>} />
          <Route path="/requester" element={<PageTransition><RequesterHome /></PageTransition>} />
          <Route path="/requester/history" element={<PageTransition><RequestHistory /></PageTransition>} />
          <Route path="/requester/requests/:requestId" element={<PageTransition><RequestDetail /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactInbox /></PageTransition>} />
          <Route path="/contact/verifications/:verificationId" element={<PageTransition><VerificationDetail /></PageTransition>} />
          <Route path="/dashboard/:requesterId" element={<PageTransition><FamilyDashboard /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}
