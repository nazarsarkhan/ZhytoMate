export default function Shell({ children, className = "bg-background" }) {
  return <div className={`phone-shell relative flex flex-col ${className}`}>{children}</div>;
}
