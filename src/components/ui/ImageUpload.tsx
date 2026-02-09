import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import Button from './Button';

interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null) => void;
  onRemove: () => void; // To clear existing URL
  className?: string;
}

export default function ImageUpload({ value, onChange, onRemove, className }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update preview if external value changes (e.g. loading edit form)
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie apenas arquivos de imagem (PNG, JPG, WEBP).');
      return;
    }
    
    // Create local preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    onChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPreview(null);
    onChange(null);
    onRemove();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={cn("w-full", className)}>
      <label className="text-sm font-medium text-gray-700 mb-2 block">
        Imagem do Produto
      </label>
      
      <div
        className={cn(
          "relative w-full h-48 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden group",
          dragActive 
            ? "border-indigo-500 bg-indigo-50" 
            : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400",
          preview ? "border-solid border-gray-200 bg-white" : ""
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleChange}
        />

        {preview ? (
          <>
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-full object-contain p-2" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white font-medium text-sm">Clique para alterar</p>
            </div>
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors z-10"
              title="Remover imagem"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="text-center p-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors",
              dragActive ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"
            )}>
              <UploadCloud size={24} />
            </div>
            <p className="text-sm font-medium text-gray-900">
              <span className="text-indigo-600 hover:underline">Clique para upload</span> ou arraste e solte
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG ou WEBP (max. 5MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
