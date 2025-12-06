/**
 * 사이트 상세 API
 *
 * GET /api/admin/sites/:id - 사이트 상세 조회
 * PUT /api/admin/sites/:id - 사이트 수정
 * DELETE /api/admin/sites/:id - 사이트 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ===========================================
// GET - 사이트 상세
// ===========================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const site = await prisma.landingSite.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sessions: true,
            pageViews: true,
            clickEvents: true,
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (error) {
    console.error('Site GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// PUT - 사이트 수정
// ===========================================

interface UpdateSiteRequest {
  name?: string;
  slug?: string;
  subdomain?: string;
  description?: string;
  isActive?: boolean;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateSiteRequest = await request.json();

    // 사이트 존재 확인
    const existing = await prisma.landingSite.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // 슬러그 변경 시 중복 확인
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.landingSite.findUnique({
        where: { slug: body.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'slug already exists' },
          { status: 409 }
        );
      }
    }

    // 업데이트
    const site = await prisma.landingSite.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.subdomain !== undefined && { subdomain: body.subdomain || null }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(site);
  } catch (error) {
    console.error('Site PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// DELETE - 사이트 삭제
// ===========================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 사이트 존재 확인
    const existing = await prisma.landingSite.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // 삭제 (관련 데이터도 cascade 삭제됨)
    await prisma.landingSite.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Site DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
