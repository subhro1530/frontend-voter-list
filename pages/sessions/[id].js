import ProtectedRoute from "../../components/ProtectedRoute";
import SessionDetail from "../../components/SessionDetail";

export default function SessionDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <SessionDetail />
    </ProtectedRoute>
  );
}
