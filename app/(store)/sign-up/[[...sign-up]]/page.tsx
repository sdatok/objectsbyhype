import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 pt-16 pb-24 bg-white">
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary:
              "bg-black hover:bg-neutral-800 text-sm normal-case",
            card: "shadow-none border border-neutral-200",
          },
        }}
      />
    </div>
  );
}
