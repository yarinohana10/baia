import { createTestApp, resetDb, signUp, type TestApp } from './app';

const HOME = {
  recipientName: 'Dana Levi',
  phone: '050-1234567',
  city: 'Tel Aviv',
  street: 'Dizengoff',
  number: '1',
  apartment: '4',
  zip: '6433201',
};
const WORK = { recipientName: 'Dana Levi', phone: '052-7654321', city: 'Haifa', street: 'Herzl', number: '22' };

describe('Address book (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => resetDb(t.prisma));

  it('requires a session', async () => {
    await t.http().get('/v1/addresses').expect(401);
    await t.http().post('/v1/addresses').send(HOME).expect(401);
  });

  it('creates, lists, updates and deletes the caller’s addresses', async () => {
    const a = await signUp(t);
    const home = await a.agent.post('/v1/addresses').send(HOME).expect(201);
    expect(home.body).toMatchObject({ ...HOME, isDefault: true });
    expect(home.body.userId).toBeUndefined();

    const work = await a.agent.post('/v1/addresses').send(WORK).expect(201);
    expect(work.body).toMatchObject({ ...WORK, apartment: null, zip: null, isDefault: false });

    const list = await a.agent.get('/v1/addresses').expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toEqual([home.body.id, work.body.id]);

    const patched = await a.agent
      .patch(`/v1/addresses/${home.body.id}`)
      .send({ city: '  Jaffa ', apartment: '' })
      .expect(200);
    expect(patched.body).toMatchObject({ city: 'Jaffa', apartment: null, street: 'Dizengoff' });

    await a.agent.delete(`/v1/addresses/${work.body.id}`).expect(204);
    expect(await t.prisma.address.count()).toBe(1);
  });

  it('keeps exactly one default', async () => {
    const a = await signUp(t);
    const home = (await a.agent.post('/v1/addresses').send(HOME).expect(201)).body;
    const work = (await a.agent.post('/v1/addresses').send({ ...WORK, isDefault: true }).expect(201)).body;
    expect(work.isDefault).toBe(true);
    expect((await t.prisma.address.findUniqueOrThrow({ where: { id: home.id } })).isDefault).toBe(false);

    await a.agent.post(`/v1/addresses/${home.id}/default`).expect(200);
    const defaults = await t.prisma.address.findMany({ where: { isDefault: true } });
    expect(defaults.map((x) => x.id)).toEqual([home.id]);

    // isDefault: false cannot leave the user without a default.
    await a.agent.patch(`/v1/addresses/${home.id}`).send({ isDefault: false }).expect(200);
    expect((await t.prisma.address.findUniqueOrThrow({ where: { id: home.id } })).isDefault).toBe(true);

    // Deleting the default promotes the remaining address.
    await a.agent.delete(`/v1/addresses/${home.id}`).expect(204);
    expect((await t.prisma.address.findUniqueOrThrow({ where: { id: work.id } })).isDefault).toBe(true);
  });

  it("user A cannot read, modify, default or delete user B's addresses (404)", async () => {
    const a = await signUp(t);
    const b = await signUp(t);
    const bHome = (await b.agent.post('/v1/addresses').send(HOME).expect(201)).body;
    await a.agent.post('/v1/addresses').send(WORK).expect(201);

    const aList = await a.agent.get('/v1/addresses').expect(200);
    expect(aList.body).toHaveLength(1);
    expect(aList.body[0].city).toBe('Haifa');

    await a.agent.get(`/v1/addresses/${bHome.id}`).expect(404);
    await a.agent.patch(`/v1/addresses/${bHome.id}`).send({ city: 'Eilat' }).expect(404);
    await a.agent.post(`/v1/addresses/${bHome.id}/default`).expect(404);
    await a.agent.delete(`/v1/addresses/${bHome.id}`).expect(404);

    const untouched = await t.prisma.address.findUniqueOrThrow({ where: { id: bHome.id } });
    expect(untouched).toMatchObject({ city: 'Tel Aviv', isDefault: true, userId: b.user.id });
  });

  it('ignores a client-supplied userId', async () => {
    const a = await signUp(t);
    const b = await signUp(t);
    const res = await a.agent.post('/v1/addresses').send({ ...HOME, userId: b.user.id }).expect(201);
    const row = await t.prisma.address.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.userId).toBe(a.user.id);
    expect(await b.agent.get('/v1/addresses').expect(200).then((r) => r.body)).toEqual([]);
  });

  it('validates fields', async () => {
    const a = await signUp(t);
    await a.agent.post('/v1/addresses').send({ ...HOME, phone: 'call me' }).expect(400);
    await a.agent.post('/v1/addresses').send({ ...HOME, city: '   ' }).expect(400);
    await a.agent.post('/v1/addresses').send({ ...HOME, street: 'x'.repeat(151) }).expect(400);
    const { body } = await a.agent.post('/v1/addresses').send(HOME).expect(201);
    await a.agent.patch(`/v1/addresses/${body.id}`).send({ number: '' }).expect(400);
    expect(await t.prisma.address.count()).toBe(1);
  });

  it('caps the number of saved addresses', async () => {
    const a = await signUp(t);
    const user = a.user.id;
    await t.prisma.address.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({ ...WORK, userId: user, number: String(i), isDefault: i === 0 })),
    });
    const res = await a.agent.post('/v1/addresses').send(HOME).expect(400);
    expect(res.body.code).toBe('ADDRESS_LIMIT_REACHED');
  });

  it('deleting the user deletes their addresses', async () => {
    const a = await signUp(t);
    await a.agent.post('/v1/addresses').send(HOME).expect(201);
    await t.prisma.user.delete({ where: { id: a.user.id } });
    expect(await t.prisma.address.count()).toBe(0);
  });
});
