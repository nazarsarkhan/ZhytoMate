import React from "react";

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function trimUrl(value) {
  const match = value.match(/^(.*?)([),.;!?»”]+)?$/);
  return { url: match?.[1] || value, trailing: match?.[2] || "" };
}

export default function LinkifiedText({ children }) {
  const text = String(children ?? "");
  return text.split("\n").map((line, lineIndex) => (
    <React.Fragment key={`line-${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {line.split(URL_RE).map((part, partIndex) => {
        if (!/^https?:\/\//i.test(part)) return <React.Fragment key={`part-${partIndex}`}>{part}</React.Fragment>;
        const { url, trailing } = trimUrl(part);
        return (
          <React.Fragment key={`part-${partIndex}`}>
            <a href={url} target="_blank" rel="noreferrer" className="break-all underline decoration-outline hover:text-primary-container">
              {url}
            </a>
            {trailing}
          </React.Fragment>
        );
      })}
    </React.Fragment>
  ));
}
