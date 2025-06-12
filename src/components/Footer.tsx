import React from 'react';
import { BookOpen, Facebook, Twitter, Instagram, Mail, MapPin, Download } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <BookOpen className="w-8 h-8 text-amber-500" />
              <span className="text-xl font-bold text-white">Note Library</span>
            </div>
            <p className="mb-6">
              Providing quality education resources for grades 11 & 12. Helping students achieve academic excellence through comprehensive notes and test series.
            </p>
            <div className="flex flex-col space-y-4">
              <div className="flex space-x-4">
                <a 
                  href="https://www.facebook.com/notelibrary" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a 
                  href="https://www.instagram.com/notelibraryofficial/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
              <a 
                href="https://play.google.com/store/apps/details?id=com.notes.notelibrary&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-sm max-w-fit"
              >
                <div className="bg-white bg-opacity-20 rounded-lg p-1 mr-3 group-hover:bg-opacity-30 transition-all duration-300">
                  <Download className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs opacity-90">GET IT ON</span>
                  <span className="text-sm font-bold leading-tight">Google Play</span>
                </div>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="Test-series" className="hover:text-white transition-colors">Test Series</a>
              </li>
              <li>
                <a href="notes" className="hover:text-white transition-colors">Notes</a>
              </li>
              <li>
                <a href="ioe-predictor" className="hover:text-white transition-colors">IOE Predictor</a>
              </li>
              <li>
                <a href="blog" className="hover:text-white transition-colors">Blog</a>
              </li>
              <li>
                <a href="community" className="hover:text-white transition-colors">Community</a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 text-amber-500 flex-shrink-0" />
                <span>Kathmandu, Nepal</span>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 mr-3 text-amber-500 flex-shrink-0" />
                <span>content.notelibrary@gmail.com</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 mt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Note Library. All rights reserved.</p>
          <p className="mt-2">
              Made with ❤️ for students everywhere
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;