declare module 'unexpected' {
  
  interface Unexpected {
    (subj: any, assertion: string, ...args: any[]): Promise<void>;
    clone(): Unexpected;
    use(plugin: any): Unexpected;
    it(...args: any): Unexpected;
  }

  const expect: Unexpected;
  export = expect;

}
