import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RolePicker } from "./pages/RolePicker";
import { RequesterHome } from "./pages/requester/RequesterHome";
import { RequestDetail } from "./pages/requester/RequestDetail";
import { RequestHistory } from "./pages/requester/RequestHistory";
import { ContactInbox } from "./pages/contact/ContactInbox";
import { VerificationDetail } from "./pages/contact/VerificationDetail";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<RolePicker />} />
        <Route path="/requester" element={<RequesterHome />} />
        <Route path="/requester/history" element={<RequestHistory />} />
        <Route path="/requester/requests/:requestId" element={<RequestDetail />} />
        <Route path="/contact" element={<ContactInbox />} />
        <Route path="/contact/verifications/:verificationId" element={<VerificationDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
