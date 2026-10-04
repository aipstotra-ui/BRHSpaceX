import { AppNav } from "@/components/ui/AppNav";

/** The pages that use the plain top bar: landing and cases. The testing page brings its own context into the bar. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
