import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';

const ItemMaster = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
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
    } catch (error) {
      toast.error('Failed to fetch user data');
    }
  };

  const fetchItems = async () => {
    try {
      const response = await api.get('/items');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to fetch items');
    }
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
      } else {
        await api.post('/items', {
          ...formData,
          item_rate: parseFloat(formData.item_rate),
        });
        toast.success('Item created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
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
      <div className="space-y-6" data-testid="item-master-page">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Item Master</h2>
            <p className="text-gray-600">Manage your inventory items</p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-item-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
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
              {items.map((item) => (
                <TableRow key={item.item_code} data-testid={`item-row-${item.item_code}`}>
                  <TableCell>{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.uom}</TableCell>
                  <TableCell>{item.item_rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} data-testid={`edit-item-${item.item_code}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.item_code)} data-testid={`delete-item-${item.item_code}`}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No items found. Add your first item to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="item-dialog">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update item details' : 'Add a new item to your inventory'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="item_code">Item Code</Label>
                  <Input
                    id="item_code"
                    data-testid="item-code-input"
                    value={formData.item_code}
                    onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                    disabled={!!editingItem}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="item_name">Item Name</Label>
                  <Input
                    id="item_name"
                    data-testid="item-name-input"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    data-testid="item-category-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="uom">UOM (Unit of Measure)</Label>
                  <Input
                    id="uom"
                    data-testid="item-uom-input"
                    placeholder="e.g., Pcs, Kg, Ltr"
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="item_rate">Rate</Label>
                  <Input
                    id="item_rate"
                    data-testid="item-rate-input"
                    type="number"
                    step="0.01"
                    value={formData.item_rate}
                    onChange={(e) => setFormData({ ...formData, item_rate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="save-item-btn">
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
