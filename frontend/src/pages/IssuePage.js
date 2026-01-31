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

const IssuePage = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempItems, setTempItems] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item_code: '',
    issued_qty: '',
  });

  const filteredItems = items.filter((item) =>
    item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.item_code.toLowerCase().includes(itemSearch.toLowerCase())
  );

  useEffect(() => {
    fetchUser();
    fetchEntries();
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

  const fetchEntries = async () => {
    try {
      const response = await api.get('/issue');
      setEntries(response.data);
    } catch (error) {
      toast.error('Failed to fetch issue entries');
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
    if (tempItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    try {
      // Submit all items in temp list
      for (const item of tempItems) {
        await api.post('/issue', {
          date: new Date(item.date).toISOString(),
          item_code: item.item_code,
          issued_qty: parseFloat(item.issued_qty),
        });
      }
      toast.success('All issue entries created successfully');
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
    if (!formData.item_code || !formData.issued_qty) {
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
      issued_qty: '',
    });
  };

  if (!user) return <div>Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6" data-testid="issue-page">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Issue Entries</h2>
            <p className="text-gray-600">Record items issued from inventory</p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="add-issue-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Issue
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Description</TableHead>
                <TableHead>Quantity Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.entry_id} data-testid={`issue-row-${entry.entry_id}`}>
                  <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{entry.item_code}</TableCell>
                  <TableCell>{entry.item_description}</TableCell>
                  <TableCell>{entry.issued_qty}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No issue entries found. Add your first entry to get started.
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
          <DialogContent data-testid="issue-dialog" className="max-w-4xl max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Issue Entry</DialogTitle>
              <DialogDescription>Record items issued from inventory</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Form to add/edit items */}
              <form onSubmit={handleAddItem}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      data-testid="issue-date-input"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
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
                      <SelectTrigger data-testid="issue-item-select">
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
                    <Label htmlFor="issued_qty">Quantity to Issue</Label>
                    <Input
                      id="issued_qty"
                      data-testid="issue-qty-input"
                      type="number"
                      step="0.01"
                      value={formData.issued_qty}
                      onChange={(e) => setFormData({ ...formData, issued_qty: e.target.value })}
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
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tempItems.map((item, index) => (
                          <TableRow key={index} className={editingIndex === index ? 'bg-blue-50' : ''}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.item_code}</TableCell>
                            <TableCell>{item.issued_qty}</TableCell>
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
                data-testid="save-issue-btn"
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

export default IssuePage;