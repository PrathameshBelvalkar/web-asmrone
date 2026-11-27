import AppKit
import CoreGraphics

// usage: swift icon.swift <source.png> <appRes> <designsystemRes>
let args = CommandLine.arguments
let src = NSImage(contentsOfFile: args[1])!
var rect = CGRect(origin: .zero, size: src.size)
let cg = src.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
let W = cg.width, H = cg.height

// Read pixels (RGBA8).
let cs = CGColorSpaceCreateDeviceRGB()
var px = [UInt8](repeating: 0, count: W * H * 4)
let readCtx = CGContext(data: &px, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
readCtx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
func at(_ x: Int, _ y: Int) -> (Double, Double, Double) {
    let i = (y * W + x) * 4
    return (Double(px[i]), Double(px[i + 1]), Double(px[i + 2]))
}

// Background: average of the four corners.
var bg = (0.0, 0.0, 0.0)
for (x, y) in [(5, 5), (W - 6, 5), (5, H - 6), (W - 6, H - 6)] { let c = at(x, y); bg.0 += c.0 / 4; bg.1 += c.1 / 4; bg.2 += c.2 / 4 }
func dist(_ c: (Double, Double, Double)) -> Double { abs(c.0 - bg.0) + abs(c.1 - bg.1) + abs(c.2 - bg.2) }

// Content bounds (anything clearly not background).
var minX = W, minY = H, maxX = 0, maxY = 0
for y in 0..<H { for x in 0..<W where dist(at(x, y)) > 45 {
    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
} }
let cx = Double(minX + maxX) / 2, cy = Double(minY + maxY) / 2
let side = Double(max(maxX - minX, maxY - minY))
print(String(format: "bg #%02X%02X%02X  content %d,%d – %d,%d", Int(bg.0), Int(bg.1), Int(bg.2), minX, minY, maxX, maxY))

// Monochrome source: the dark navy shapes (cat, outlines) as white with alpha.
var mono = [UInt8](repeating: 0, count: W * H * 4)
for y in 0..<H { for x in 0..<W {
    let c = at(x, y); let lum = (0.299 * c.0 + 0.587 * c.1 + 0.114 * c.2) / 255
    let a = UInt8(max(0, min(1, (0.55 - lum) / 0.15)) * 255)
    let i = (y * W + x) * 4
    mono[i] = a; mono[i + 1] = a; mono[i + 2] = a; mono[i + 3] = a
} }
let monoCtx = CGContext(data: &mono, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let monoImage = monoCtx.makeImage()!

/// Draws the content square so it spans [contentDp] of a [canvasDp] canvas rendered at [px] pixels.
func render(_ image: CGImage, px size: Int, canvasDp: Double, contentDp: Double, fill: Bool) -> CGImage {
    let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.interpolationQuality = .high
    if fill {
        ctx.setFillColor(CGColor(red: bg.0 / 255, green: bg.1 / 255, blue: bg.2 / 255, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
    }
    let scale = Double(size) * contentDp / canvasDp / side
    let w = Double(W) * scale, h = Double(H) * scale
    // Centre the content's centre (image y is flipped in CoreGraphics).
    let ox = Double(size) / 2 - cx * scale
    let oy = Double(size) / 2 - (Double(H) - cy) * scale
    ctx.draw(image, in: CGRect(x: ox, y: oy, width: w, height: h))
    return ctx.makeImage()!
}

func save(_ image: CGImage, _ path: String) {
    try? FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
    let rep = NSBitmapImageRep(cgImage: image)
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

// Adaptive icon layers: 108 dp canvas, content inside the 66 dp safe zone.
let densities = [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0), ("xxhdpi", 3.0), ("xxxhdpi", 4.0)]
for (name, f) in densities {
    let size = Int(108 * f)
    save(render(cg, px: size, canvasDp: 108, contentDp: 68, fill: true), "\(args[2])/mipmap-\(name)/ic_launcher_foreground.png")
    save(render(monoImage, px: size, canvasDp: 108, contentDp: 68, fill: false), "\(args[2])/mipmap-\(name)/ic_launcher_monochrome.png")
}
// In-app splash mark: the content a little inset in a square tile.
save(render(cg, px: 512, canvasDp: 100, contentDp: 84, fill: true), "\(args[3])/drawable-nodpi/nekohub_mark.png")
// System splash icon: 240 dp canvas, shown in a 160 dp circle; drawn at xxxhdpi so it stays sharp.
save(render(cg, px: 960, canvasDp: 240, contentDp: 150, fill: true), "\(args[2])/drawable-xxxhdpi/splash_icon.png")
