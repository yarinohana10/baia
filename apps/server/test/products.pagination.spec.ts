jest.mock('../src/auth/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));

import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { clampInt } from '../src/products/pagination';

describe('clampInt', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-5', 1],
    ['2.7', 2],
    ['7', 7],
    ['100000', 100],
  ])('clampInt(%p) -> %p', (raw, expected) => {
    expect(clampInt(raw as string | undefined, 1, 1, 100)).toBe(expected);
  });
});

describe('ProductsController paging', () => {
  const service = {
    findAll: jest.fn().mockResolvedValue({}),
    findAllAdmin: jest.fn().mockResolvedValue([]),
    findAllAdminPage: jest.fn().mockResolvedValue({}),
  };
  const controller = new ProductsController(service as unknown as ProductsService);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['0', '0', 1, 1],
    ['abc', 'xyz', 1, 20],
    ['3', '100000', 3, 100],
    [undefined, undefined, 1, 20],
  ])('public list page=%p limit=%p -> page %p limit %p', (page, limit, expPage, expLimit) => {
    controller.findAll(undefined, undefined, page, limit, undefined);
    expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ page: expPage, limit: expLimit }));
  });

  it('admin list without page keeps the legacy array response', () => {
    controller.findAllAdmin('q', undefined);
    expect(service.findAllAdmin).toHaveBeenCalledWith({ search: 'q', categoryId: undefined });
    expect(service.findAllAdminPage).not.toHaveBeenCalled();
  });

  it('admin list with page is paginated (default 50, max 200)', () => {
    controller.findAllAdmin(undefined, undefined, '2', undefined);
    expect(service.findAllAdminPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 50 }));
    controller.findAllAdmin(undefined, undefined, 'x', '5000');
    expect(service.findAllAdminPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 200 }));
  });
});
