import { useEffect } from "react";
import { useRouter } from "next/router";

export default function NominationsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/nominations/manual-entry");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-neon-400 border-t-transparent" />
    </div>
  );
}
