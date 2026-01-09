export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white py-3 text-center z-50 border-t border-gray-700">
      <p className="text-sm">
        Created by{" "}
        <a
          href="https://ssaha.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
        >
          Shaswata Saha
        </a>{" "}
        | © {new Date().getFullYear()} All Rights Reserved
      </p>
    </footer>
  );
}
