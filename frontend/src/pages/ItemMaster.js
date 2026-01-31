import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';
import Papa from 'papaparse';

const ItemMaster = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [csvFile, setCsvFile] = useState(null);

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    category: '',
    uom: '',
    item_rate: '',
  });

  useEffect(() => {
    fetchUser();
    fetchItems();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      toast.error('Failed to fetch user data');
    }
  };

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch {
      toast.error('Failed to fetch items');
    }
  };

  const handleCSVUpload = () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;

        const requiredHeaders = ['item_code', 'item_name', 'category', 'uom', 'item_rate'];
        const fileHeaders = Object.keys(rows[0] || {});
        const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));

        if (missingHeaders.length > 0) {
          toast.error(`Missing headers: ${missingHeaders.join(', ')}`);
          return;
        }

        try {
          for (const row of rows) {
            await api.post('/items', {
              item_code: row.item_code,
              item_name: row.item_name,
              category: row.category,
              uom: row.uom,
              item_rate: parseFloat(row.item_rate),
            });
          }

          toast.success('CSV items imported successfully');
          setCsvFile(null);
          fetchItems();
        } catch {
          toast.error('Error importing CSV items');
        }
      },
      error: () => toast.error('Failed to parse CSV file'),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.patch(`/items/${editingItem.item_code}`, {
          item_name: formData.item_name,
          category: formData.category,
          uom: formData.uom,
          item_rate: parseFloat(formData.item_rate),
        });
        toast.success('Item updated successfully');
        setIsDialogOpen(false);
        resetForm();
      } else {
        await api.post('/items', {
          ...formData,
          item_rate: parseFloat(formData.item_rate),
        });
        toast.success('Item created successfully');
        resetForm();
      }
      fetchItems();
    } catch (error) {
      const errorMsg = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Operation failed';
      toast.error(errorMsg);
    }
  };

  const handleCreateAndAddMore = async () => {
    try {
      await api.post('/items', {
        ...formData,
        item_rate: parseFloat(formData.item_rate),
      });
      toast.success('Item created successfully');
      resetForm();
      fetchItems();
    } catch (error) {
      const errorMsg = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Operation failed';
      toast.error(errorMsg);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      uom: item.uom,
      item_rate: item.item_rate.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (item_code) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/items/${item_code}`);
      toast.success('Item deleted successfully');
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({
      item_code: '',
      item_name: '',
      category: '',
      uom: '',
      item_rate: '',
    });
    setEditingItem(null);
  };

  if (!user) return <div>Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Item Master</h2>
            <p className="text-gray-600">Manage your inventory items</p>
          </div>

          <div className="flex gap-2 items-center">
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>

            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csvUpload"
              onChange={(e) => setCsvFile(e.target.files[0])}
            />

            <Button
              variant="outline"
              onClick={() => document.getElementById('csvUpload').click()}
            >
              Upload CSV
            </Button>

            <Button
              variant="secondary"
              onClick={handleCSVUpload}
              disabled={!csvFile}
            >
              Import
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.item_code}>
                  <TableCell>{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.uom}</TableCell>
                  <TableCell>{item.item_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.item_code)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update item details' : 'Add a new item'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label>Item Code</Label>
                  <Input
                    value={formData.item_code}
                    disabled={!!editingItem}
                    onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Item Name</Label>
                  <Input
                    value={formData.item_name}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>UOM</Label>
                  <Input
                    value={formData.uom}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.item_rate}
                    onChange={e => setFormData({ ...formData, item_rate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                {!editingItem && (
                  <Button 
                    type="button"
                    variant="secondary"
                    onClick={handleCreateAndAddMore}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create & Add More
                  </Button>
                )}
                <Button type="submit">
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ItemMaster;
