/**
 * 사이트 관리 API
 *
 * GET /api/admin/sites - 사이트 목록 조회
 * POST /api/admin/sites - 사이트 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ===========================================
// GET - 사이트 목록
// ===========================================

export async function GET() {
  try {
    const sites = await prisma.landingSite.findMany({
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json(sites);
  } catch (error) {
    console.error('Sites GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===========================================
// POST - 사이트 추가
// ===========================================

interface CreateSiteRequest {
  name: string;
  slug: string;
  subdomain?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSiteRequest = await request.json();

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    // 슬러그 중복 확인
    const existing = await prisma.landingSite.findUnique({
      where: { slug: body.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'slug already exists' },
        { status: 409 }
      );
    }

    // 사이트 생성
    const site = await prisma.landingSite.create({
      data: {
        name: body.name,
        slug: body.slug,
        subdomain: body.subdomain || null,
        description: body.description || null,
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    console.error('Sites POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
