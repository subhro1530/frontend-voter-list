import dynamic from "next/dynamic";

const SessionDetail = dynamic(() => import("../../components/SessionDetail"), {
  ssr: false,
});

export default function SessionDetailPage() {
  return <SessionDetail />;
}
