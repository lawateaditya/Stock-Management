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

const InwardPage = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item_code: '',
    inward_qty: '',
    inward_rate: '',
    supplier: '',
    ref_no: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inward', {
        date: new Date(formData.date).toISOString(),
        item_code: formData.item_code,
        inward_qty: parseFloat(formData.inward_qty),
        inward_rate: parseFloat(formData.inward_rate),
        supplier: formData.supplier,
        ref_no: formData.ref_no,
      });
      toast.success('Inward entry created successfully');
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent data-testid="inward-dialog">
            <DialogHeader>
              <DialogTitle>Add Inward Entry</DialogTitle>
              <DialogDescription>Record items received into inventory</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    data-testid="inward-date-input"
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
                    <SelectTrigger data-testid="inward-item-select">
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
                  <Input
                    id="supplier"
                    data-testid="inward-supplier-input"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    required
                  />
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
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="save-inward-btn">
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

export default InwardPage;