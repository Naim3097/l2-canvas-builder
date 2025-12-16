'use client';

import React from 'react';
import Link from 'next/link';
import { 
  PenTool, 
  Layers, 
  Zap, 
  Image as ImageIcon, 
  Type, 
  Grid, 
  Download, 
  Cpu, 
  MousePointer2, 
  Scissors,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Navigation Bar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">X</div>
            <span className="font-bold text-xl tracking-tight">X-IDE</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#roadmap" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Roadmap</a>
            <a href="#tech" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Technology</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/editor">
              <button className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2">
                Launch Editor <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-8 border border-blue-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            v0.1 Public Preview
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8 text-slate-900">
            The Next-Gen <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">AI Design IDE</span>
          </h1>
          
          <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            A professional-grade vector graphics editor built for the web. 
            Featuring advanced path editing, boolean operations, and AI-powered tools.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/editor">
              <button className="h-12 px-8 rounded bg-slate-900 text-white font-semibold text-lg hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
                Start Designing
              </button>
            </Link>
            <a href="#features">
              <button className="h-12 px-8 rounded border border-slate-200 text-slate-700 font-semibold text-lg hover:bg-slate-50 transition-all">
                Explore Features
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* App Preview / Hero Image Placeholder */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto rounded-xl border border-slate-200 shadow-2xl overflow-hidden bg-slate-50 aspect-[16/9] relative group">
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50">
            <p className="text-slate-400 font-medium">Interactive Workspace Preview</p>
          </div>
          {/* In a real scenario, put a screenshot or iframe of the editor here */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none"></div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Professional Vector Tools</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Built to match industry standards with a focus on performance and precision.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<PenTool />}
              title="Advanced Pen Tool"
              description="Cubic Bezier engine with precise handle controls for creating complex vector shapes."
            />
            <FeatureCard 
              icon={<Zap />}
              title="Boolean Operations"
              description="Non-destructive Union, Subtract, Intersect, and Exclude operations powered by Paper.js."
            />
            <FeatureCard 
              icon={<Layers />}
              title="Artboards & Layers"
              description="Multi-artboard support with a comprehensive layer tree for organizing complex projects."
            />
            <FeatureCard 
              icon={<MousePointer2 />}
              title="Smart Guides"
              description="Intelligent snapping engine for precise alignment and spacing distribution."
            />
            <FeatureCard 
              icon={<Type />}
              title="Typography"
              description="Advanced text support including Type on Path, kerning, and Google Fonts integration."
            />
            <FeatureCard 
              icon={<ImageIcon />}
              title="Image Trace"
              description="Convert raster images to editable vector paths instantly with our tracing engine."
            />
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section id="roadmap" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Roadmap to Premium</h2>
            <p className="text-lg text-slate-600">
              We are actively developing the next generation of vector graphics technology.
            </p>
          </div>

          <div className="space-y-8">
            <RoadmapItem 
              title="Robust Vector Engine"
              status="In Progress"
              description="Implementing a spec-compliant SVG path parser to support all path commands (M, L, H, V, C, S, Q, T, A, Z)."
            />
            <RoadmapItem 
              title="Matrix-Based Transform System"
              status="Planned"
              description="Adopting a 2x3 Affine Transformation Matrix model for complex skewing and shearing operations."
            />
            <RoadmapItem 
              title="Delta-Based History"
              status="Planned"
              description="Optimizing memory usage by tracking state changes (patches) instead of full snapshots."
            />
            <RoadmapItem 
              title="Spatial Indexing"
              status="Planned"
              description="Implementing Quadtree spatial indexing for high-performance rendering of thousands of objects."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to create?</h2>
          <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto">
            Join the future of design with X-IDE. Open source, powerful, and built for the web.
          </p>
          <Link href="/editor">
            <button className="h-14 px-10 rounded bg-white text-slate-900 font-bold text-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Launch X-IDE Now
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-white text-xs font-bold">X</div>
            <span className="font-bold text-slate-900">X-IDE</span>
          </div>
          <div className="text-slate-500 text-sm">
            © 2025 X-IDE Project. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-lg border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all group">
      <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-blue-600">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function RoadmapItem({ title, status, description }: { title: string, status: string, description: string }) {
  return (
    <div className="flex gap-4 items-start p-6 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
      <div className="mt-1 text-blue-600">
        <CheckCircle2 size={24} />
      </div>
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
            {status}
          </span>
        </div>
        <p className="text-slate-600">{description}</p>
      </div>
    </div>
  );
}
