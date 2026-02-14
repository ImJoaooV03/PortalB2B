import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  Image as ImageIcon, 
  Loader2, 
  DollarSign,
  Upload,
  Download,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ImageUpload from '../components/ui/ImageUpload';
import { useForm } from 'react-hook-form';
import { formatCurrency } from '../lib/utils';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import Papa from 'papaparse';

export default function Products() {
  const { isClient, user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- CSV Logic ---

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.info('Nenhum produto para exportar.');
      return;
    }

    // Define headers and map data (Removed IMAGEM_URL)
    const csvData = products.map(p => ({
      NOME: p.name,
      SKU: p.sku,
      DESCRICAO: p.description || '',
      PRECO_BASE: p.base_price,
      STATUS: p.status
    }));

    const csv = Papa.unparse(csvData, {
      quotes: true,
      delimiter: ",",
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `produtos_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    // Removed IMAGEM_URL from template
    const templateData = [
      {
        NOME: "Produto Exemplo",
        SKU: "PROD-001",
        DESCRICAO: "Descrição detalhada do produto",
        PRECO_BASE: "150.00"
      },
      {
        NOME: "Outro Produto",
        SKU: "PROD-002",
        DESCRICAO: "",
        PRECO_BASE: "50.50"
      }
    ];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_produtos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const newProducts: any[] = [];
        const errors: string[] = [];

        // Validate and Transform
        rows.forEach((row, index) => {
          const lineNum = index + 2; // +1 header, +1 zero-index
          
          if (!row.NOME || !row.SKU || !row.PRECO_BASE) {
            errors.push(`Linha ${lineNum}: Campos NOME, SKU e PRECO_BASE são obrigatórios.`);
            return;
          }

          // Clean currency string if necessary
          let priceString = String(row.PRECO_BASE).replace('R$', '').trim();
          if (priceString.includes(',') && !priceString.includes('.')) {
             priceString = priceString.replace('.', '').replace(',', '.');
          }
          const price = parseFloat(priceString);

          if (isNaN(price)) {
            errors.push(`Linha ${lineNum}: Preço inválido.`);
            return;
          }

          newProducts.push({
            name: row.NOME,
            sku: row.SKU,
            description: row.DESCRICAO || '',
            base_price: price,
            image: null, // Always null for CSV import
            status: 'active',
            created_by: user?.id
          });
        });

        if (errors.length > 0) {
          toast.error(`Erros encontrados:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '...' : ''}`);
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        if (newProducts.length === 0) {
          toast.info('Nenhum produto válido encontrado no arquivo.');
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        try {
          // Batch Insert
          const { error } = await supabase.from('products').insert(newProducts);
          
          if (error) {
            if (error.code === '23505') { // Unique violation
              toast.error('Erro: Alguns SKUs já existem no sistema.');
            } else {
              throw error;
            }
          } else {
            toast.success(`${newProducts.length} produtos importados com sucesso!`);
            fetchProducts();
          }
        } catch (err: any) {
          console.error(err);
          toast.error('Erro ao salvar produtos no banco de dados.');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        console.error(err);
        toast.error('Erro ao ler o arquivo CSV.');
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  // --- End CSV Logic ---

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
      toast.error('Erro ao fazer upload da imagem.');
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
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase.from('products').insert([{ ...payload, status: 'active', created_by: user?.id }]);
        if (error) throw error;
        toast.success('Produto criado!');
      }
      
      await fetchProducts();
      closeModal();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Erro ao salvar produto.');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
      toast.success('Produto excluído.');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Erro ao excluir produto. Verifique se está em uso.');
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
      reset({ status: 'active', base_price: 0 });
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
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader 
        title="Produtos"
        subtitle="Gerencie seu catálogo de produtos"
        action={
          <div className="flex flex-wrap gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileChange} 
            />
            
            <Button 
              variant="secondary" 
              onClick={handleDownloadTemplate} 
              leftIcon={<FileSpreadsheet size={18} />}
              title="Baixar modelo de planilha"
            >
              MODELO
            </Button>

            <Button 
              variant="secondary" 
              onClick={handleExportCSV} 
              leftIcon={<Download size={18} />}
              title="Exportar produtos atuais"
            >
              EXPORTAR
            </Button>

            <Button 
              variant="secondary" 
              onClick={handleImportClick} 
              isLoading={importing}
              leftIcon={<Upload size={18} />}
              title="Importar produtos via CSV"
            >
              IMPORTAR
            </Button>

            <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
              NOVO PRODUTO
            </Button>
          </div>
        }
      />

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white flex flex-col md:flex-row gap-4 justify-between items-center">
          <Input 
            placeholder="BUSCAR POR NOME OU SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
            className="max-w-md"
          />
          <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <HelpCircle size={14} />
            Total: {filteredProducts.length} produtos
          </div>
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
            <p className="text-sm text-gray-500 mt-2">Cadastre manualmente ou importe uma planilha.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Preço Base</th>
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
                    <td className="px-6 py-4 text-black font-bold">
                      {formatCurrency(product.base_price || 0)}
                    </td>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Dados Básicos */}
          <div className="space-y-6">
            
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

            <div className="space-y-2">
              <Input
                label="Valor Base (R$)"
                type="number"
                step="0.01"
                min="0"
                {...register('base_price', { required: 'Preço base é obrigatório', min: 0 })}
                error={errors.base_price?.message}
                placeholder="0.00"
                icon={<DollarSign size={16} />}
              />
              <p className="text-xs text-gray-500 font-medium">
                Preço de tabela sem descontos.
              </p>
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
          </div>

          <div className="flex items-center gap-2 pt-2 border-t-2 border-black mt-6">
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

          <div className="flex justify-end gap-3">
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
