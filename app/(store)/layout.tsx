import { CartProvider } from "@/context/CartContext";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import StoreAccountSync from "@/components/store/StoreAccountSync";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <StoreAccountSync />
      <Header />
      <main className="pt-11">{children}</main>
      <Footer />
      <VercelAnalytics />
    </CartProvider>
  );
}
