import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          自己進化型 社内QAシステム
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          GA x Vertex AI による自己進化型QAシステム
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/qa"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium transition-colors hover:bg-blue-700"
          >
            Start QA Chat
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 text-gray-700 dark:text-gray-300 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
