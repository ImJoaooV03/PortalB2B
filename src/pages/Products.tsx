import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Package, Image as ImageIcon, Loader2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ImageUpload from '../components/ui/ImageUpload';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

export default function Products() {
  const { isClient, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Partial<Product>>();

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erro ao fazer upload da imagem.');
      return null;
    }
  };

  const onSubmit = async (data: Partial<Product>) => {
    try {
      let imageUrl = data.image;

      if (selectedFile) {
        const uploadedUrl = await uploadImage(selectedFile);
        if (uploadedUrl) imageUrl = uploadedUrl;
      } else if (imageRemoved) {
        imageUrl = null;
      }

      const payload = { ...data, image: imageUrl };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([{ ...payload, status: 'active' }]);
        if (error) throw error;
      }
      
      await fetchProducts();
      closeModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto.');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erro ao excluir produto.');
    }
  };

  const openModal = (product?: Product) => {
    setSelectedFile(null);
    setImageRemoved(false);
    if (product) {
      setEditingProduct(product);
      reset(product);
    } else {
      setEditingProduct(null);
      reset({ status: 'active' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setSelectedFile(null);
    setImageRemoved(false);
    reset();
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isClient) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader 
        title="Produtos"
        subtitle="Gerencie seu catálogo de produtos"
        action={
          <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
            NOVO PRODUTO
          </Button>
        }
      />

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white">
          <Input 
            placeholder="BUSCAR POR NOME OU SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="animate-spin text-black" size={32} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-black">
            <div className="w-16 h-16 bg-black text-white flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <Package size={32} />
            </div>
            <p className="font-bold uppercase tracking-wide">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white border-2 border-black flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-contain grayscale" />
                          ) : (
                            <ImageIcon className="text-gray-300" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-black uppercase">{product.name}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px] uppercase">{product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-black font-mono font-bold text-xs">{product.sku}</td>
                    <td className="px-6 py-4">
                      <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>
                        {product.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => openModal(product)}
                          className="h-8 w-8"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteProduct(product.id)}
                          className="h-8 w-8 hover:bg-black hover:text-white"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Input
                label="Nome do Produto"
                {...register('name', { required: 'Nome é obrigatório' })}
                error={errors.name?.message}
                placeholder="EX: CADEIRA ERGONÔMICA"
              />
            </div>
            
            <div className="space-y-2">
              <Input
                label="SKU"
                {...register('sku', { required: 'SKU é obrigatório' })}
                error={errors.sku?.message}
                placeholder="EX: CAD-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-black block uppercase">Descrição</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-black rounded-none focus:ring-1 focus:ring-black focus:border-black outline-none resize-none text-sm"
              placeholder="DETALHES DO PRODUTO..."
            />
          </div>

          <ImageUpload 
            value={editingProduct?.image}
            onChange={(file) => {
              setSelectedFile(file);
              if (file) setImageRemoved(false);
            }}
            onRemove={() => {
              setSelectedFile(null);
              setImageRemoved(true);
            }}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="status"
              {...register('status')}
              value="active"
              defaultChecked={!editingProduct || editingProduct.status === 'active'}
              className="w-4 h-4 rounded-none border-black text-black focus:ring-black cursor-pointer"
            />
            <label htmlFor="status" className="text-sm font-bold text-black cursor-pointer select-none uppercase">Produto Ativo</label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              CANCELAR
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingProduct ? 'SALVAR ALTERAÇÕES' : 'SALVAR PRODUTO'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
