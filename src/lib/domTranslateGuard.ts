/**
 * Chrome's translator and the Google Translate widget rewrite text nodes.
 * React then throws NotFoundError on removeChild/insertBefore and the app
 * unmounts to a blank page. Ignore DOM moves the translator already made.
 */
export function installGoogleTranslateDomGuard(): void {
  if (typeof Node !== 'function') return
  const proto = Node.prototype as Node & { __safapayTranslateGuard?: boolean }
  if (proto.__safapayTranslateGuard) return
  proto.__safapayTranslateGuard = true

  const originalRemoveChild = proto.removeChild
  proto.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return originalRemoveChild.call(this, child) as T
  }

  const originalInsertBefore = proto.insertBefore
  proto.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    node: T,
    child: Node | null,
  ): T {
    if (child && child.parentNode !== this) return node
    return originalInsertBefore.call(this, node, child) as T
  }
}
