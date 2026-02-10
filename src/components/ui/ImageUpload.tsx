import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  className?: string;
}

export default function ImageUpload({ value, onChange, onRemove, className }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      alert('Apenas imagens.');
      return;
    }
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
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn("w-full", className)}>
      <label className="text-sm font-bold text-black mb-2 block uppercase">
        Imagem
      </label>
      
      <div
        className={cn(
          "relative w-full h-48 border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden group",
          dragActive 
            ? "border-black bg-black text-white" 
            : "border-black bg-white hover:bg-gray-50",
          preview ? "border-solid" : ""
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
        />

        {preview ? (
          <>
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full h-full object-contain p-2 grayscale" 
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white font-bold text-sm uppercase">Alterar</p>
            </div>
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-white border border-black text-black hover:bg-black hover:text-white transition-colors z-10"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="text-center p-4">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center mx-auto mb-3 border-2 border-black",
              dragActive ? "bg-white text-black" : "bg-black text-white"
            )}>
              <UploadCloud size={24} />
            </div>
            <p className="text-sm font-bold uppercase">
              Clique ou Arraste
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
