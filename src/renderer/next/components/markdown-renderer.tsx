import { Streamdown } from "streamdown";
import styles from "./markdown-renderer.module.scss";

export type MarkdownRendererProps = {
  source: string;
  className?: string;
};

export const MarkdownRenderer = (props: MarkdownRendererProps) => {
  return (
    <div className={props.className || MarkdownRenderer.defaultStylesClassName}>
      <Streamdown>{props.source}</Streamdown>
    </div>
  );
};

MarkdownRenderer.defaultStylesClassName = styles.md;
