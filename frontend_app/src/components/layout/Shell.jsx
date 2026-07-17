import SideNav from "../navigation/SideNav.jsx";

export default function Shell({ children, className = "bg-background" }) {
  return (
    <div className={`phone-shell relative flex min-h-dvh flex-col overflow-x-hidden lg:h-dvh lg:min-h-0 lg:flex-row lg:overflow-hidden ${className}`}>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden lg:h-dvh lg:min-h-0 lg:overflow-y-auto lg:rounded-b-[28px]">{children}</div>
    </div>
  );
}
