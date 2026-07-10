import { Document, Model } from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id);
  }

  async findOne(filter: any): Promise<T | null> {
    return this.model.findOne(filter);
  }

  async find(filter: any = {}, sort?: any): Promise<T[]> {
    const query = this.model.find(filter);
    if (sort) {
      return query.sort(sort);
    }
    return query;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true });
  }

  async updateOne(filter: any, data: Partial<T>): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, data, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id);
    return !!result;
  }

  async deleteOne(filter: any): Promise<boolean> {
    const result = await this.model.findOneAndDelete(filter);
    return !!result;
  }
}
