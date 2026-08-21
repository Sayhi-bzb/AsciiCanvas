export type CharGraphAwaitable<T> = T | Promise<T>;

export interface CharGraphRenderer<TOptions = undefined> {
  readonly id: string;
  render(source: string, options?: TOptions): CharGraphAwaitable<string>;
}

export const defineCharGraphRenderer = <TOptions = undefined>(
  renderer: CharGraphRenderer<TOptions>
): CharGraphRenderer<TOptions> => renderer;

export const renderCharGraph = async <TOptions>(
  source: string,
  renderer: CharGraphRenderer<TOptions>,
  options?: TOptions
): Promise<string> => {
  const rendered = await renderer.render(source, options);
  if (typeof rendered !== "string") {
    throw new TypeError(
      `CharGraph renderer "${renderer.id}" returned a non-string result.`
    );
  }
  return rendered.replace(/\r\n?/g, "\n");
};
