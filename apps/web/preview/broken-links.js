// Docusaurus collects anchors during its native server render. The standalone
// preview validates its final DOM separately and uses the same client no-op API.
const clientCollector = { collectAnchor() {}, collectLink() {} };
export default function useBrokenLinks() {
  return clientCollector;
}
