export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-3 z-50 border-t border-gray-700/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Creator Credit */}
          <p className="text-xs sm:text-sm text-center sm:text-left">
            Created by{" "}
            <a
              href="https://ssaha.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              Shaswata Saha
            </a>
          </p>

          {/* Contact & Copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <a
              href="mailto:acodernamedsubhro@gmail.com"
              className="text-xs text-gray-400 hover:text-neon-300 transition-colors flex items-center gap-1"
            >
              <span>📧</span>
              <span className="hidden sm:inline">
                acodernamedsubhro@gmail.com
              </span>
              <span className="sm:hidden">Contact</span>
            </a>
            <span className="hidden sm:inline text-gray-600">|</span>
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
