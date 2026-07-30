import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Markdown.module.css";

export function Markdown({ content }: { content: string }) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <pre className={styles.codeBlock}>
                  <code {...props}>{children}</code>
                </pre>
              );
            }
            return (
              <code className={styles.inlineCode} {...props}>
                {children}
              </code>
            );
          },
          a(props) {
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
          table(props) {
            return (
              <div className={styles.tableWrap}>
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
