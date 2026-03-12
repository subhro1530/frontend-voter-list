import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AffidavitsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/affidavits/manual-entry");
  }, [router]);
  return null;
}
