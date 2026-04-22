"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";

export default function ClearCartOnSuccess() {
  const { clearCart } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on thank-you page
  }, []);

  return null;
}
