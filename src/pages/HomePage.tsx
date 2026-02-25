import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { ChildSelector } from '../components/children/ChildSelector';
import { useAppStore } from '../stores/useAppStore';

export function HomePage() {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedChildId) {
      navigate('/lists', { replace: true });
    }
  }, [selectedChildId, navigate]);

  return (
    <div className="min-h-full bg-gradient-to-b from-cyan-50 to-white flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">TaalTrainer</h1>
        <p className="text-gray-500 text-base">
          Kies wie er overhoord wordt
        </p>
      </div>

      <ChildSelector />
    </div>
  );
}
