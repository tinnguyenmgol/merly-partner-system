"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Variant = "public" | "dashboard" | "admin" | "auth";

const sizes: Record<Variant, string> = {
  public: "h-10 w-auto",
  dashboard: "h-9 w-auto",
  admin: "h-9 w-auto",
  auth: "h-11 w-auto",
};

export function MerlyLogo({
  variant = "public",
  withText = false,
  href = "/",
}: {
  variant?: Variant;
  withText?: boolean;
  href?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const text = withText ? "Merly Partner" : "Merly Shoes";

  return (
    <Link href={href} className="inline-flex items-center gap-3">
      {!imageFailed ? (
        <Image
          src="/logo/merly-logo.png"
          alt="Merly Shoes"
          width={160}
          height={44}
          priority
          className={sizes[variant]}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-xl font-bold text-merly-900">Merly Shoes</span>
      )}
      {withText && <span className="font-semibold text-merly-900">{text}</span>}
    </Link>
  );
}
