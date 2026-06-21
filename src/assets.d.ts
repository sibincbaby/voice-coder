// esbuild inlines these as strings via --loader:.html=text --loader:.css=text.
declare module "*.html" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const content: string;
  export default content;
}
