import SideNav from "../navigation/SideNav.jsx";

export default function Shell({ children, className = "bg-background" }) {
  return (
    <div className={`phone-shell relative flex min-h-dvh flex-col overflow-x-hidden ${className}`}>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">{children}</div>
    </div>
  );
}
