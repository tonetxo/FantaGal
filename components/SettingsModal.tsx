import React from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
    onSave: (key: string) => void;
    setApiKey: (key: string) => void;
}

const SettingsModal = ({ isOpen, onClose, apiKey, onSave, setApiKey }: SettingsModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-stone-100">
            <div className="bg-stone-900 border border-stone-700 p-6 w-full max-w-md rounded-lg shadow-2xl">
                <h3 className="text-lg font-bold text-orange-500 mb-4">Configuración de Gemini</h3>
                <p className="text-xs text-stone-400 mb-4">Introduce a túa API Key.</p>
                <input
                    type="password"
                    placeholder="API Key..."
                    className="w-full bg-black/50 border border-stone-600 p-3 text-sm mb-4 focus:border-orange-500 outline-none"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-stone-400">Cancelar</button>
                    <button onClick={() => onSave(apiKey)} className="px-4 py-2 bg-orange-600 rounded">Gardar</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
