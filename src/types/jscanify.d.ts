declare module "jscanify" {
  class jscanify {
    highlightPaper(
      image: HTMLCanvasElement | HTMLImageElement,
    ): HTMLCanvasElement;
    extractPaper(
      image: HTMLCanvasElement | HTMLImageElement,
      resultWidth: number,
      resultHeight: number,
    ): HTMLCanvasElement;
  }
  export default jscanify;
}
