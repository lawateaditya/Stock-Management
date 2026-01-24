import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

const IssuePage = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item_code: '',
    issued_qty: '',
  });

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
    try {
      await api.post('/issue', {
        date: new Date(formData.date).toISOString(),
        item_code: formData.item_code,
        issued_qty: parseFloat(formData.issued_qty),
      });
      toast.success('Issue entry created successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="issue-dialog">
            <DialogHeader>
              <DialogTitle>Add Issue Entry</DialogTitle>
              <DialogDescription>Record items issued from inventory</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
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
                    onValueChange={(value) => setFormData({ ...formData, item_code: value })}
                  >
                    <SelectTrigger data-testid="issue-item-select">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.item_code} value={item.item_code}>
                          {item.item_code} - {item.item_name}
                        </SelectItem>
                      ))}
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
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="save-issue-btn">
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default IssuePage;