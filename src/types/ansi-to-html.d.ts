declare module "ansi-to-html" {
  export interface ConverterOptions {
    fg?: string;
    bg?: string;
    newline?: boolean;
    escapeXML?: boolean;
    stream?: boolean;
    colors?: string[] | { [key: string]: string };
  }

  export default class Filter {
    constructor(options?: ConverterOptions);
    toHtml(input: string): string;
  }
}
