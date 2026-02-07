import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const InwardPage = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempItems, setTempItems] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item_code: '',
    inward_qty: '',
    inward_rate: '',
    supplier: '',
    ref_no: '',
  });

  const filteredItems = items.filter((item) =>
    item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  useEffect(() => {
    fetchUser();
    fetchEntries();
    fetchItems();
    fetchSuppliers();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      toast.error('Failed to fetch user data');
    }
  };

  const fetchEntries = async () => {
    try {
      const response = await api.get('/inward');
      setEntries(response.data);
    } catch (error) {
      toast.error('Failed to fetch inward entries');
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

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to fetch suppliers');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tempItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    try {
      // Submit all items in temp list
      for (const item of tempItems) {
        await api.post('/inward', {
          date: new Date(item.date).toISOString(),
          item_code: item.item_code,
          inward_qty: parseFloat(item.inward_qty),
          inward_rate: parseFloat(item.inward_rate),
          supplier: item.supplier,
          ref_no: item.ref_no,
        });
      }
      toast.success('All inward entries created successfully');
      resetForm();
      setTempItems([]);
      setIsDialogOpen(false);
      fetchEntries();
    } catch (error) {
      const errorMsg = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Operation failed';
      toast.error(errorMsg);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!formData.item_code || !formData.inward_qty || !formData.inward_rate || !formData.supplier || !formData.ref_no) {
      toast.error('Please fill all fields');
      return;
    }

    if (editingIndex !== null) {
      // Update existing item
      const updatedItems = [...tempItems];
      updatedItems[editingIndex] = { ...formData };
      setTempItems(updatedItems);
      setEditingIndex(null);
      toast.success('Item updated');
    } else {
      // Add new item
      setTempItems([...tempItems, { ...formData }]);
      toast.success('Item added to list');
    }
    resetForm();
  };

  const handleEditItem = (index) => {
    setFormData(tempItems[index]);
    setEditingIndex(index);
  };

  const handleDeleteItem = (index) => {
    const updatedItems = tempItems.filter((_, i) => i !== index);
    setTempItems(updatedItems);
    if (editingIndex === index) {
      setEditingIndex(null);
      resetForm();
    }
    toast.success('Item removed');
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      item_code: '',
      inward_qty: '',
      inward_rate: '',
      supplier: '',
      ref_no: '',
    });
  };

  if (!user) return <div>Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6" data-testid="inward-page">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Inward Entries</h2>
            <p className="text-gray-600">Record items received into inventory</p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-inward-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Inward
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Ref No</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.entry_id} data-testid={`inward-row-${entry.entry_id}`}>
                  <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{entry.item_code}</TableCell>
                  <TableCell>{entry.item_description}</TableCell>
                  <TableCell>{entry.inward_qty}</TableCell>
                  <TableCell>{entry.inward_rate.toFixed(2)}</TableCell>
                  <TableCell>{entry.inward_value.toFixed(2)}</TableCell>
                  <TableCell>{entry.supplier}</TableCell>
                  <TableCell>{entry.ref_no}</TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      if (!user) return null;
                      const isSuperAdmin = user.role === 'super_admin';
                      const isAdmin = user.role === 'admin';
                      const canDelete = isSuperAdmin || isAdmin;
                      if (!canDelete) return null;

                      return (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete this inward entry?')) return;
                            try {
                              await api.delete(`/inward/${entry.entry_id}`);
                              toast.success('Inward entry deleted');
                              fetchEntries();
                            } catch (err) {
                              toast.error(err.response?.data?.detail || 'Delete failed');
                            }
                          }}
                          data-testid={`delete-inward-${entry.entry_id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No inward entries found. Add your first entry to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setTempItems([]);
            setEditingIndex(null);
            resetForm();
          }
        }}>
          <DialogContent data-testid="inward-dialog" className="max-w-6xl max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Inward Entry</DialogTitle>
              <DialogDescription>Record items received into inventory</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Form to add/edit items */}
              <form onSubmit={handleAddItem}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      data-testid="inward-date-input"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      // {format(new Date(entry.date), 'dd/MM/yyyy')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="item_code">Item</Label>
                    <Select
                      value={formData.item_code}
                      onValueChange={(value) => {
                        setFormData({ ...formData, item_code: value });
                        setItemSearch('');
                      }}
                    >
                      <SelectTrigger data-testid="inward-item-select">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Search by name or code..."
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            className="mb-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {filteredItems.length > 0 ? (
                          filteredItems.map((item) => (
                            <SelectItem key={item.item_code} value={item.item_code}>
                              {item.item_code} - {item.item_name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-gray-500">
                            No items found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inward_qty">Quantity</Label>
                    <Input
                      id="inward_qty"
                      data-testid="inward-qty-input"
                      type="number"
                      step="0.01"
                      value={formData.inward_qty}
                      onChange={(e) => setFormData({ ...formData, inward_qty: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="inward_rate">Rate</Label>
                    <Input
                      id="inward_rate"
                      data-testid="inward-rate-input"
                      type="number"
                      step="0.01"
                      value={formData.inward_rate}
                      onChange={(e) => setFormData({ ...formData, inward_rate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="supplier">Supplier</Label>
                    <Select
                      value={formData.supplier}
                      onValueChange={(value) => setFormData({ ...formData, supplier: value })}
                    >
                      <SelectTrigger data-testid="inward-supplier-select">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.supplier_id} value={supplier.supplier_id}>
                            {supplier.supplier_id} - {supplier.supplier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ref_no">Reference No</Label>
                    <Input
                      id="ref_no"
                      data-testid="inward-ref-input"
                      value={formData.ref_no}
                      onChange={(e) => setFormData({ ...formData, ref_no: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Button type="submit" variant="secondary" data-testid="add-item-btn">
                    <Plus className="mr-2 h-4 w-4" />
                    {editingIndex !== null ? 'Update Item' : 'Add Item'}
                  </Button>
                  {editingIndex !== null && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setEditingIndex(null);
                        resetForm();
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>

              {/* Display added items */}
              {tempItems.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Items to be Added</h3>
                  <div className="overflow-x-auto">
                    <Table className="text-sm">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Ref No</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tempItems.map((item, index) => (
                          <TableRow key={index} className={editingIndex === index ? 'bg-blue-50' : ''}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.item_code}</TableCell>
                            <TableCell>{item.inward_qty}</TableCell>
                            <TableCell>{parseFloat(item.inward_rate).toFixed(2)}</TableCell>
                            <TableCell>{item.supplier}</TableCell>
                            <TableCell>{item.ref_no}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditItem(index)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteItem(index)}
                                  className="h-8 w-8 p-0 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit"
                onClick={handleSubmit}
                disabled={tempItems.length === 0}
                data-testid="save-inward-btn"
              >
                Save All Items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default InwardPage;